const { handleRequest } = require("../server");

module.exports = async function vercelHandler(req, res) {
  await handleRequest(req, res);
};
