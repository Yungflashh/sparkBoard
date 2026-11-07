const { mailEnabled, mailProgram } = require("../mailer");

exports.getIndexPage = (req, res, next) => {
  res.status(200).send("Robotech Backend!");
};

exports.postBlockMessage = async (req, res, next) => {
  console.log(req.body);

  let mailStatus = "off";
  if (mailEnabled()) {
    try {
      await mailProgram(req.body);
      mailStatus = "sent";
    } catch (err) {
      console.error("Email failed:", err.message);
      mailStatus = "failed";
    }
  }

  res.setHeader("X-Mail-Status", mailStatus);
  res.status(200).json(req.body);
};
