module.exports = (req, res) => {
  res.status(200).json({
    message: 'Project Management API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
};