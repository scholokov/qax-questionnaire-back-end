const express = require('express');
const app = express();
const port = 3000;

const config = require('./config.json');

const cors = require('cors');

app.use(cors())

var mysql = require('mysql');
var pool  = mysql.createPool(config);

pool.query('SHOW DATABASES', function (error, results, fields) {
  if (error) throw error;
  console.log('res: ', results);
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});

app.get('/', (req, res) => {
  return res.send('Received a GET HTTP method');
});

app.get('/test/:slug', (req, res) => {
  pool.query(`SELECT * FROM tbl_tests WHERE test_slug='${req.params.slug}'`, function (error, results, fields) {
    if (error) throw error;

    let test = results[0];

    pool.query(`SELECT * FROM tbl_questions WHERE parent_test='${test.test_id}'`, function (error, results, fields) {
      if (error) throw error;

      test.questions = results;

      let range = [];

      for (var i = 0; i < test.questions.length; i++) {
        test.questions[i].options = [];
        range.push(test.questions[i].question_id);
      }

      pool.query(`SELECT * FROM tbl_options WHERE parent_question IN (${range})`, function (error, results, fields) {
        if (error) return console.log(error);

        for (var i = 0; i < results.length; i++) {
          for (var j = 0; j < test.questions.length; j++) {
            if (test.questions[j].question_id == results[i].parent_question) {
              test.questions[j].options.push(results[i]);
            }
          }
        }

        return res.json(test);
      });
    });
  });
});

app.get('/options/:id', (req, res) => {
  pool.query(`SELECT * FROM tbl_options WHERE parent_question='${req.params.id}'`, function (error, results, fields) {
    if (error) throw error;

    res.json(results);
  });
});
 
app.post('/', (req, res) => {
  return res.send('Received a POST HTTP method');
});
 
app.put('/', (req, res) => {
  return res.send('Received a PUT HTTP method');
});
 
app.delete('/', (req, res) => {
  return res.send('Received a DELETE HTTP method');
});


/*

app.get('/users/:userId/books/:bookId', function (req, res) {
  res.send(req.params)
})
*/