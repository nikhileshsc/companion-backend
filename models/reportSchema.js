const mongoose = require("mongoose");
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reportedUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reporterUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed"],
      default: "Pending",
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model("Reports", reportSchema);
