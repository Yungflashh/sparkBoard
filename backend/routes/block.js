const router = require("express").Router();
const blockController = require("../controllers/block-controller");

router.get("/", blockController.getIndexPage);
router.post("/", blockController.postBlockMessage);

module.exports = router;
