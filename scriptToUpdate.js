"use strict";
// Importing necessary modules
const axios = require("axios");
const { MongoClient } = require("mongodb");
const { config } = require("dotenv");
config();
// Connecting to MongoDB
// const connectToMongodb = async () => {
//   try {
//     // Connect to the MongoDB client
//     const connectClient = await MongoClient.connect(process.env.DB_URI);
//     // Log a success message
//     console.log("Successfully connected to mongodb client");
//     // Return the connected client
//     return connectClient;
//   } catch (err) {
//     // Log an error message and exit the process if the connection fails
//     console.log("Connection to mongoDB failed", err);
//   }
// };

const {
  connectToMongodb,
  fetchAndSaveRecord,
  start,
  getDrcInfo,
  geomertiesIterator,
} = require("./app");

connectToMongodb();
// Connect to the MongoDB cluster
const connectToMongoDBAndFetchData = async () => {
  try {
    const mongoClient = await connectToMongodb();
    const db = mongoClient.db("productmaster_staging");

    const length = await db
      .collection("asset-size-info")
      .find({ geometries: { $ne: null } })
      // .find({ geometries: { $not: { $type: "array" } } })
      .count();
      console.log(length)
      let skip = 0
    for (let i = 0; i < length; i++) {
      //fetch an doc from asset-size-info collection
      let  limit = 1;
      const assetSizeInfoDoc = await db
        .collection("asset-size-info")
        .find({ geometries: { $ne: null } })
        // .find({ geometries: { $not: { $type: "array" } } })
        .sort({ _id: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();
      //fetch the doc from assetGroup collection
      const assetGroupDoc = await db
        .collection("assetgroups")
        .findOne({ _id: assetSizeInfoDoc[0].assetGroupId });
      //   console.log(assetGroupDoc);

      if (assetGroupDoc.assetMetadata && assetGroupDoc.assetMetadata.webglasset && assetGroupDoc.assetMetadata.webglasset.geometries) {
        // Your code here
        // console.log(assetGroupDoc.assetMetadata.webglasset.geometries)
        const updatableGeometries = await geomertiesIterator(assetGroupDoc.assetMetadata.webglasset.geometries);
        // Update the assetSizeInfoDoc with the new geometries
        if(updatableGeometries!==undefined)
        await db
          .collection("asset-size-info")
          .updateOne({ _id: assetSizeInfoDoc[0]._id }, { $set: { geometries: updatableGeometries } });
          // console.log(assetSizeInfoDoc[0]._id)
        // console.log(updatableGeometries,assetSizeInfoDoc)
        skip+=limit
      }else{
          continue;
      }
    //   break;
    console.log(`updated ${i}th successfully`)
    }
    // Disconnect from the MongoDB cluster
    await mongoClient.close();
  } catch (err) {
    console.log("Error while connecting to MongoDB and fetching data", err);
  }
};
connectToMongoDBAndFetchData();
