import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// import FastAPI from fastapi;
// import CORSMiddleware from fastapi.middleware.cors;

const app = express();
dotenv.config();
app.use(cors());
app.use(express.json());
// app = FastAPI();

// app.add_middleware(
//     CORSMiddleware,
//     allow_origins=['*'],
//     allow_credentials=True,
//     allow_methods=['*'],
//     allow_headers=['*']
// )
 
async function createConnection(){
    const client = new MongoClient(process.env.MONGO_URL);
    await client.connect();
    console.log("mongoDB is connected");
    return client;    
}
console.log(process.env.MONGO_URL);


const auth = (req,res,next)=>{
    try{
        const token = req.header("x-auth-token");
        console.log("token",token);
        jwt.verify(token,process.env.SECRET_KEY);
        next();
    }
    catch(error){
        res.status(401).send({error:error.message});
    }
}

const client = await createConnection();
app.get("/", async function(req,res){
    res.send("HI");
} )

app.post("/createfood", async function(req,res){
    const data =  req.body;
    const result = await client.db("CRM").collection("food").insertOne(data);
    res.send(result);
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

    console.log(result);
})

app.get("/food",auth, async function(req,res){
    const result = await client.db("CRM").collection("food").find({}).toArray();
    res.send(result);
    // console.log(result);
});

app.get("/food/:id", async function(req,res){
    const {id} = req.params;
    const result = await client.db("CRM").collection("food").findOne({_id:ObjectId(id)});
    res.send(result);
});

app.patch("/updatefood/:id", async function(req,res){
    const {id} =req.params;
    const data = req.body;
    const DBlike = await client.db("CRM").collection("food").findOne({_id:ObjectId(id)});
    const updateLike = !(DBlike.likes);
    const result = await client.db("CRM").collection("food").updateOne({_id:ObjectId(id)}, {$set: {likes : updateLike}});
    res.send(result);
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

    console.log("updated"-result,DBlike.likes,updateLike);
})

app.post("/updateCarts", async function(req,res){
    const data = req.body;
    console.log(data.food)
    const cartDB = await client.db("CRM").collection("carts").find({$and:[{user:data.user},{food:data.food}]}).toArray();
    const userToken = await client.db("CRM").collection("session").findOne({username:data.user});
    console.log("data",cartDB)
    console.log("usertoken",userToken)
    if(!userToken ){

        res.status(401).send({msg : "Invalid"})
    }
    else{
        if(cartDB.length == 0  ){
            const result = await client.db("CRM").collection("carts").insertOne(data);
            res.send(result);
            res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

            console.log("updateCarts",result);
        }  
        else{
            console.log("false")
             
            res.status(404).send({msg:"You have the dish already in your cart"})
        }        
    }
});

app.get("/getCarts", async function(req,res){
    const token = req.header('user');
    // console.log(token)
    const carts = await client.db("CRM").collection("carts").find({user:token}).toArray();
    res.send(carts);
    // console.log("carts",carts);
})



app.delete("/deleteCarts/:id",async function(req,res){
    const {id}= req.params;
    const deleteCarts = await client.db("CRM").collection("carts").deleteOne({_id:ObjectId(id)});
    res.send(deleteCarts);
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

    console.log(deleteCarts);
})

app.post("/updateuser", async function(req,res){
    const data = req.body;
    const result = await client.db("CRM").collection("orderfood").insertOne(data);
    res.send(result);
    
    const quantityDB = await client.db("CRM").collection("food").findOne({name:data.food});
    if(quantityDB){
        const quantity = quantityDB.available - 1
        const updateQuantity = await client.db("CRM").collection("food").updateOne({name:data.food},{$set:{available:quantity}});
        console.log("quantityUpdated",quantityDB,quantity)
    }
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');
    console.log(result);
})

app.patch("/updatesfood/:name", async function(req,res){
    const data = req.body;
    const {name} = req.params;
    console.log(name,typeof(name));
    const food = await client.db("CRM").collection("food").findOne({name:name});
    console.log("food",food);
    const foodId = food._id;
    
    const result = await client.db("CRM").collection("food").updateOne({_id:ObjectId(foodId)},{$set :data});
    res.send(result);
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');


   
})



async function genHashedPassword(password){
    const No_of_rounds = 10;
    const salt = await bcrypt.genSalt(No_of_rounds);
    const hashePassword = await bcrypt.hash(password,salt);
    return hashePassword;
}

app.post("/users/register",async function(req,res){
    const {name,username,password} = req.body;
   console.log(username);
    const userDB = await client.db("CRM").collection("users").findOne({username:username});
    console.log(userDB)
    if(!userDB){
        const hashed = await genHashedPassword(password);
        console.log(hashed);
    const result = await client.db("CRM").collection("users").insertOne({
        name:name,
        username:username,
        password:hashed,
        isAdmin:false
    });
    res.send(result);
    res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

    console.log(result);
}
else{
    res.status(404).send({"msg": "User already exists"});
}
});

app.post("/users/signin", async function(req,res){
    const {username,password} = req.body;
    const userDB = await client.db("CRM").collection("users").findOne({username:username});
    if(userDB){
        const storedPassword = userDB.password.toString();
        console.log(userDB,storedPassword);
        const isPasswordMatched = await bcrypt.compare(password,storedPassword);
        if(isPasswordMatched){
            const token = jwt.sign({id:userDB._id},process.env.SECRET_KEY);
            await client.db("CRM").collection("session").insertOne({
                userId:userDB._id,
                username:userDB.username,
                isAdmin:userDB.isAdmin,
                token:token
            });
            res.send({msg:" Successfully signed in", token:token, isAdmin:userDB.isAdmin})
            res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');
        }
        else{
            res.status(404).send({msg: "Invalid Credentials"})
        }
    }
    else{
        res.status(404).send({msg:"Invalid credentials"});
    }
});

app.delete("/deletefood/:id",async function(req,res){
    const token = req.header("x-auth-token");
    const {id}=req.params;
    console.log(token);
    const userSession = await client.db("CRM").collection("session").findOne({token:token});
    if(userSession && userSession.isAdmin){
        const deleteFood = await client.db("CRM").collection("food").deleteOne({_id:ObjectId(id)})
        res.send(deleteFood);
        res.set('Access-Control-Allow-Origin', 'https://order-management-backend.herokuapp.com');

    }
})
app.listen(process.env.PORT, () =>{console.log(`App is running at ${process.env.PORT}`)});