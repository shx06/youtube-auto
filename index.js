require("dotenv").config();

const runPipeline = require("./jobs/pipeline.job");

async function start() {
  try {
    await runPipeline();
  } catch (err) {
    console.error(err);
  }
}

start();