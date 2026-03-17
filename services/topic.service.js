const topics = [
 "10 Facts About Black Holes",
 "Mysteries of the Ocean",
 "History of Artificial Intelligence",
 "Dark Facts About Space",
 "Future of Robots"
];

exports.getTopic = async () => {
 return topics[Math.floor(Math.random() * topics.length)];
};