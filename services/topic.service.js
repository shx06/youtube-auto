const topics = [
  "success",
  "motivation",
  "hard work",
  "gym",
  "focus",
  "discipline",
];

exports.getTopic = async () => {
  return topics[Math.floor(Math.random() * topics.length)];
};
