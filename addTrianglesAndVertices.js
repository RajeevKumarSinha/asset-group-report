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
  //   geomertiesIterator,
} = require("./app");

const download = require("download");
const path = require("path");
const fs = require("fs");
const { calculate } = require("./calcTriAndVer");

connectToMongodb();

const connectToMongoDBAndFetchData = async () => {
  try {
    const mongoClient = await connectToMongodb();
    const db = mongoClient.db("productmaster_staging");

    const length = await db
      .collection("asset-size-info")
      .find({ geometries: { $ne: null } })
      .count();
    console.log(length);
    let skip = 3700;
    let limit = 100;
    for (let i = 3700; i < length; i += 100) {
      //fetch an doc from asset-size-info collection
      const assetSizeInfoDoc = await db
        .collection("asset-size-info")
        .find({ geometries: { $ne: null } })
        .sort({ _id: -1 })
        .limit(limit)
        .skip(skip)
        .toArray();

      //Now iterate over the assetSizeInfoDoc to download drc file into the drc folder
      // update the asssetSizeInfoDoc with vertices and triangles data.
      for (let j = 0; j < assetSizeInfoDoc.length; j++) {
        let x = await geometriesIterator(assetSizeInfoDoc[j].geometries);
        assetSizeInfoDoc[j].geometries = x;
        // console.log(x)
      }
      // Update all the assetSizeInfoDoc in the database at once
      const bulkOperations = assetSizeInfoDoc.map((doc) => {
        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { geometries: doc.geometries } }
          }
        };
      });
      
      await db.collection("asset-size-info").bulkWrite(bulkOperations);;

      // now update the limit and skip
      skip += limit;
      console.log(`updated from ${i} - ${skip} successfully`);
    }
    // Disconnect from the MongoDB cluster
    await mongoClient.close();
  } catch (err) {
    console.log("Error while connecting to MongoDB and fetching data", err);
  }
};
connectToMongoDBAndFetchData();
async function geometriesIterator(geometries) {
  try {
    //1. Download the drc files first
    const drcFolder = "./drc";

    if (!fs.existsSync(drcFolder)) {
      fs.mkdirSync(drcFolder);
    }

    for (let i = 0; i < geometries.length; i++) {
      const drcUrl = geometries[i].drcpath;
      const drcFileName = `${geometries[i].name}.drc`;
      // const drcFilePath = path.join(drcFolder, drcFileName);

      await download(drcUrl, drcFolder, { filename: drcFileName });
    }
    //2. now Add triangle and vertices in the geometries
    geometries = await Promise.all(
      geometries.map(async (item) => {
        const triVer = await calculate(`./drc/${item.name}.drc`);
        // console.log(triVer);
        item = { ...item, ...triVer };
        fs.unlinkSync(`./drc/${item.name}.drc`);
        return item;
      })
    );
    //3. Delete the downloaded drc files
    fs.readdirSync(drcFolder).forEach((file) => {
      fs.unlinkSync(path.join(drcFolder, file));
    });
    return geometries;
  } catch (error) {
    console.log(error);
  }
}

// geomertiesIterator([
//     {
//         "name" : "PDACACH_00002_DELD0087_BASE",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_BASE.drc",
//         "fileSize" : 6459
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_LEAF",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_LEAF.drc",
//         "fileSize" : 2998
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_LEAF2",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_LEAF2.drc",
//         "fileSize" : 16777
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_LEAF6",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_LEAF6.drc",
//         "fileSize" : 20721
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_MUD",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_MUD.drc",
//         "fileSize" : 905
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_STREM",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_STREM.drc",
//         "fileSize" : 4332
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_STREM2",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_STREM2.drc",
//         "fileSize" : 3232
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_STREM3",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_STREM3.drc",
//         "fileSize" : 8000
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_VASE1",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_VASE1.drc",
//         "fileSize" : 4474
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_VASE2",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_VASE2.drc",
//         "fileSize" : 3580
//     },
//     {
//         "name" : "PDACACH_00002_DELD0087_VASE3",
//         "drcpath" : "https://foyrproductmaster.s3.ap-south-1.amazonaws.com/assestgroup/00000063-0000-4001-A000-00E100000000/webglassets/PDACACH_00002_DELD0087_VASE3.drc",
//         "fileSize" : 3545
//     }
// ])
