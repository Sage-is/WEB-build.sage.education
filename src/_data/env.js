// Build-time environment passthrough. PB_URL empty means the capture forms
// degrade to a note instead of posting anywhere.
module.exports = {
  pbUrl: process.env.PB_URL || "",
};
