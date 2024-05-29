const fs = require("fs");
const assert = require("assert");
const draco3d = require("draco3d");

async function calculate(path) {
  const decoderModule = await draco3d.createDecoderModule({});
  const encoderModule = await draco3d.createEncoderModule({});

  if (encoderModule && decoderModule) {
    try {
      const data = await fs.promises.readFile(path);

      // Decode mesh
      const decoder = new decoderModule.Decoder();
      const decodedGeometry = decodeDracoData(data, decoder, decoderModule);

      const numFaces = decodedGeometry.num_faces();
      const numPoints = decodedGeometry.num_points();

      const drcGeometryData = {
        vertex: numPoints,
        triangle: numFaces,
      };

      // console.log(drcGeometryData);

      decoderModule.destroy(decoder);
      decoderModule.destroy(decodedGeometry);

      return drcGeometryData;
    } catch (err) {
      console.log(err);
    }
  }
}

function decodeDracoData(rawBuffer, decoder, decoderModule) {
  const buffer = new decoderModule.DecoderBuffer();
  buffer.Init(new Int8Array(rawBuffer), rawBuffer.byteLength);
  const geometryType = decoder.GetEncodedGeometryType(buffer);

  let dracoGeometry;
  let status;

  if (geometryType === decoderModule.TRIANGULAR_MESH) {
    dracoGeometry = new decoderModule.Mesh();
    status = decoder.DecodeBufferToMesh(buffer, dracoGeometry);
  } else if (geometryType === decoderModule.POINT_CLOUD) {
    dracoGeometry = new decoderModule.PointCloud();
    status = decoder.DecodeBufferToPointCloud(buffer, dracoGeometry);
  } else {
    console.error("Error: Unknown geometry type.");
  }

  decoderModule.destroy(buffer);

  return dracoGeometry;
}

// calculate("./drc/PDACACH_00002_DELD0087_BASE.drc").then(value => console.log(value));

module.exports = {calculate};