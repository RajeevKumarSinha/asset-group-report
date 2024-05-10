"use strict";
// Importing necessary modules
const axios = require("axios");
const { MongoClient } = require("mongodb");
const { config } = require("dotenv");

// Configuring environment variables
config();

// Connecting to MongoDB
const connectToMongodb = async () => {
  try {
    // Connect to the MongoDB client
    const connectClient = await MongoClient.connect(process.env.DB_URI);
    // Log a success message
    console.log("Successfully connected to mongodb client");
    // Return the connected client
    return connectClient;
  } catch (err) {
    // Log an error message and exit the process if the connection fails
    console.log("Connection to mongoDB failed", err);
    ;
  }
};

// Task
// fetch 1000 records sort them on their _id to keep data consitent;
// filter out _id as assetGroupId, assetName, drcPath, sizeInbytes;
// since geometries can have multiple drcPath and assetNames so, iterate on geometries and then add it into current document
// after processing the thousand documents bulk write these data into a new collection called asset-size-info

// function to get the info from the link
const getDrcInfo = async (url) => {
  try {
    return axios.head(url);
  } catch (err) {
    console.log("Error while fetching data from the link", err);
  }
};

// function to iterate over geometries and then return the
const geomertiesIterator = async (geometries) => {
  try {
    // extract keys to iterate over geometries
    const keys = Object.keys(geometries);
    const returnableGeometries = [];
    const drcInfosReq = [];
    keys.forEach((item) => {
      // call the request function to make axios head request to drcpath to obtain info.
      drcInfosReq.push(getDrcInfo(geometries[item].drcpath));
    });
    let drcInfosRes = await Promise.all(drcInfosReq);
    keys.forEach((item, index) => {
      returnableGeometries[index] = {
        name: geometries[item].name,
        drcpath: geometries[item].drcpath,
        fileSize: drcInfosRes[index].headers["content-length"],
      };
    });
    // drcInfosRes = drcInfosRes.map(item => item.headers['content-length'])
    return returnableGeometries;
  } catch (err) {
    console.log("Error while iterating over geometries", err);
  }
};

// function to fetch and save records
const fetchAndSaveRecord = async (limit = 2, skip = 0, db) => {
  try {
    //first connect to the mongodb cluster
    // const mongoClient = await connectToMongodb();
    // const db = mongoClient.db("productmaster_staging");
    //get the data from the assetgroups sorted on _id
    const data = await db
      .collection("assetgroups")
      .find({})
      .sort({ _id: 1 })
      .limit(limit)
      .skip(skip)
      .toArray();
      // console.log(data.length)
    // filter the recieved data and transform it into mongodb exportable
    let transformedData = data.map(async (item) => {
      let transformedItemToReturn = {};
      // console.log(item);
      // create a function to iterate over the geometries
      transformedItemToReturn.assetGroupId = item._id;
      transformedItemToReturn.assetGroupName = item.name;
      transformedItemToReturn.geometries = await geomertiesIterator(
        item.assetMetadata.webglasset.geometries
      );
      // console.log(transformedItemToReturn)
      return transformedItemToReturn;
    });
    transformedData = await Promise.all(transformedData);

    // bulk write these data into a new collection called asset-size-info
    await db.collection("asset-size-info").insertMany(transformedData);
    console.log(`Inserted data from ${skip} to ${skip+limit}`);
    
  } catch (err) {
    console.log("Error while fetching and saving records", err);
  }
};

// function to start the process
const start = async () => {
  try {
    // Connect to the MongoDB cluster
    const mongoClient = await connectToMongodb();
    const db = mongoClient.db("productmaster_staging");
  
    // Get the total number of documents in the 'assetgroups' collection
    const dbSize = await db.collection("assetgroups").countDocuments();
    console.log(dbSize)
    // Initialize the skip and limit variables for pagination
    let skip = 0, limit = 500;
  
    // Loop through the documents in the 'assetgroups' collection
    while(dbSize!==0){
      // If the remaining documents are less than the limit, set the limit to the remaining documents
      if(dbSize-skip<=500){
        limit = dbSize-skip
      }
    
      // Fetch and save records based on the current skip and limit
      await fetchAndSaveRecord(limit,skip, db)
    
      // Increment the skip by the limit
      skip+=limit;
    
      // If the limit is not equal to 500, break the loop
      if(limit!==500){
        break;
      }
    }
    // Exit the process
    // Disconnect from the MongoDB cluster
    await mongoClient.close();
  } catch (err) {
    console.log("Error while starting the process", err);
  }
};
start()