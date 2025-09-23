const generateDb = (componentSpec) => {
  return `import mongoose from "mongoose";

const DB = {
    _connection: null,
    models: {},
    externalModelsConfig: []
};

DB.connect = (url) => {
    // console.log('process.env.DATABASE_URL:' ,process.env.DATABASE_URL);
    console.log("Attempting to connect with Database = ", url);
    DB._connection = mongoose.connect(url, { //promise
        // useMongoClient: true,  //rpi (mongoose 4.x) compat
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    DB.loadExternalCollections();

    return DB._connection;
};

DB.loadExternalCollections = async function () {
    const results = await Promise.allSettled(
        DB.externalModelsConfig.map(config =>
            DB.addExternalCollection(config.key, config.url, config.collectionName)
        )
    );

    results.forEach((result, idx) => {
        const { key } = DB.externalModelsConfig[idx];
        if (result.status === 'rejected') {
            console.error("ERROR: Failed to load external collection [\${key}]:", result.reason);
        } else {
            console.log("Successfully loaded external collection [\${key}]");
        }
    });
};

DB.addExternalCollection = async (key, connOrUrl, collectionName) => {
    let conn;

    if (typeof connOrUrl === 'string') {
        conn = await mongoose.createConnection(connOrUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    } else {
        conn = connOrUrl;
    }

    conn.on("connected", () => console.log("External DB [\${key}] connected"));
    conn.on("error", err => console.log("External DB [\${key}] error: \${err}"));
    conn.on("disconnected", () => console.log("External DB [\${key}] disconnected"));

    // Attach as Mongoose model instead of raw collection
    const schema = new mongoose.Schema({}, { strict: false });
    DB.models[key] = conn.model(key, schema, collectionName);

    DB._extConnections = DB._extConnections || {};
    DB._extConnections[key] = conn;
};


// CONNECTION EVENTS
// When successfully connected
mongoose.connection.on("connected", function () {
    console.log("Database default connection open");
});

// If the connection throws an error
mongoose.connection.on("error", function (err) {
    console.log("Database default connection error: \${err}");
});

// When the connection is disconnected
mongoose.connection.on("disconnected", function () {
    console.log("Database default connection disconnected");
});

// If the Node process ends, close the Mongoose connection
process.on("SIGINT", async () => {
    try {
        await mongoose.connection.close();
        console.log("Database default connection disconnected through app termination");

        if (DB._extConnections) {
            for (const [key, conn] of Object.entries(DB._extConnections)) {
                await conn.close();
                console.log("External DB [\${key}] disconnected through app termination");
            }
        }

        process.exit(0);
    } catch (e) {
        console.error("ERROR: SIGINT mongoose close failed - ", e);
        process.exit(1);
    }
});

export { DB };`;
};

module.exports = generateDb;
