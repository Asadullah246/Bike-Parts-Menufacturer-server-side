const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
const stripe = require("stripe")('sk_test_51L0j6aDZSfscydCvdmDR7jEtdXOHcrAWIz7Kj6zo4OWyex3G8YwXhEB5pW3w3KYkGukVmQtUmv4JisPPQfMhUqqa00suhUEnk7');


// middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.j7shq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.DB_JWT, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const partsCollection = client.db("bikePartsData").collection("parts");
        const orderCollection = client.db("bikePartsData").collection("orders");
        const userCollection = client.db("bikePartsData").collection("users");
        const reviewsCollection = client.db("bikePartsData").collection("reviews");

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.get('/parts', async (req, res) => {
            const parts = await partsCollection.find({}).toArray();
            res.send(parts);
        })
        app.get("/users", async (req, res) => {
            const query = {}
            const user = await userCollection.find(query).toArray();
            res.send(user);
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.DB_JWT, { expiresIn: '1h' })
            res.send({ result, token });




        });
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
          })
        app.put('/users/admin/:email',verifyJWT,verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.post('/parts', (req, res) => {
            const newPart = req.body;
            partsCollection.insertOne(newPart);
            res.send(newPart);
        })
        app.get('/parts/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const part = await partsCollection.findOne(query);

            res.send(part);
        })
        app.get('/allOrders',verifyJWT,verifyAdmin, async (req, res) => {
            const allOrders = await orderCollection.find({}).toArray();
            res.send(allOrders);

        })
        app.get('/orders',verifyJWT, async (req, res) => {
            console.log(req.headers.authorization);
            const email = req.headers.email;
            const query = { email: email };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);

        })
        app.get('/orders/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const orders = await orderCollection.findOne(query);
            res.send(orders);

        })
        app.delete('/orders/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const orders = await orderCollection.deleteOne(query);
            res.send(orders);

        })
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const insertOrder = await orderCollection.insertOne(order);
            res.send({ success: true });
        })
        app.post('/create-payment-intent',verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.totalPrice;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });
        app.patch('/manageOrder/:id',verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            // const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
        })
        app.delete("/parts/:id",verifyJWT,async(req,res)=>{
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await partsCollection.deleteOne(query);
            res.send(result);
        })

        app.put("/parts/:id", async (req, res) => {
            const id = req.params.id;
            const newQuantity = req.body.quantity;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true };
            if (newQuantity > 0) {
                const updateQuantity = {
                    $set: {
                        quantity: newQuantity

                    }

                };
                const update = await partsCollection.updateOne(filter, updateQuantity)
                res.send({ success: true })

            }
            else {
                res.send({ error: "Quantity cannot be negative" })
            } 

        })
        app.put("/orders/:id", async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            
                const updateOrder = {
                    $set: {
                        status: "delivered"

                    }

                };
                const update = await orderCollection.updateOne(filter, updateOrder, options)
                res.send({ success: true })

        })
        app.get("/reviews",async (req, res)=>{
            const reviews = await reviewsCollection.find({}).toArray();
            res.send(reviews);
        })
        app.put("/updated/:email",async(req, res)=>{
            const email=req.params.email;
            const user=req.body;
            // console.log("useer", email,user);
            const filter = { email: email };
            const options = { upsert: true };
            const updateUser = {
                $set: user

            };
            const update = await userCollection.updateOne(filter, updateUser, options)
                res.send(update)


        })

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('backend running');
})
app.listen(port, () => {
    console.log("listening this ", port);
})