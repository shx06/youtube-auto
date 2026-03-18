const topics = [
  "success",
  "motivation",
  "hard work",
  "gym",
  "focus",
  "discipline",
];

const topic = topics[Math.floor(Math.random() * topics.length)];
exports.getTopic = async () => {
  return topic;
};
