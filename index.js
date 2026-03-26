const app = require('./server/index');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`[root] AEVUM API listening on port ${PORT}`);
});
