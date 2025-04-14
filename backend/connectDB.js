const mongoose = require('mongoose');

const string_connection = process.env.MONGODB_URI

try{
  mongoose.connect(string_connection) 
  console.log('connected to database mongo dev')
}catch(error){
  console.log(error)
}