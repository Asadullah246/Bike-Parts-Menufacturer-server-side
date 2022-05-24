const express=require('express');
const cors=require('cors');
const app=express();
const jwt=require('jsonwebtoken');
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port=process.env.PORT || 5000;

// middleware 
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.j7shq.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run(){
    try{
        await client.connect();
        const partsCollection = client.db("bikePartsData").collection("parts");
        const orderCollection = client.db("bikePartsData").collection("orders");
        app.get('/parts', async (req, res) => {
            const parts=await partsCollection.find({}).toArray();
            res.send(parts);
        })
        app.get('/parts/:id',async(req,res)=>{
            const id=req.params.id;
            const query={_id:ObjectId(id)};
            const part=await partsCollection.findOne(query);
            res.send(part);
        })
        app.post('/orders',async(req,res)=>{
            const order=req.body;
            const insertOrder=await orderCollection.insertOne(order);
            res.send({success:true});
        })

        app.put("/parts/:id", async (req, res) => {
            const id = req.params.id;
            const newQuantity = req.body.quantity;
            const filter = { _id: ObjectId(id) }
            const option = { upsert: true };
            if(newQuantity>0){
                const updateQuantity = {
                    $set: {
                        quantity: newQuantity
    
                    }
    
                };
                const update = await partsCollection.updateOne(filter, updateQuantity)
                res.send({success:true})

            }
            else{
                res.send({error:"Quantity cannot be negative"})
            }
            
        })

    }
    finally{

    }
}
run().catch(console.dir);


app.get('/',(req, res)=>{
    res.send('backend running');
})
app.listen(port, ()=>{
    console.log("listening this ", port);
})