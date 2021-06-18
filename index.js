const express = require('express');
var bodyParser = require('body-parser');
const app = express();
const port = 3000;
var jsonParser = bodyParser.json();
const config = require('./config.json');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const cors = require('cors');

app.use(cors());

function newToken() {
  return '_' + Math.random().toString(36).substr(2, 9);
};

let users = {};

var mysql = require('mysql');
var pool  = mysql.createPool(config);

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

app.get('/checkAuth/:token', (req, res) => {
  if (!req.params.token) return res.json({ success: 0, error: "Give me a token" });

  let authenticated = false;

  Object.entries(users).forEach(([key, value]) => {
    if (value.token == req.params.token) {
      authenticated = true;
      return res.json({ authenticated: 1 });
    }
  });

  if (!authenticated) return res.json({ authenticated: 0 });
});

app.post('/auth', jsonParser, (req, res) => {
  if (req.body.username && req.body.password) {
    pool.query(`SELECT * FROM tbl_users WHERE username='${req.body.username}'`, function (error, results, fields) {
      if (error)  return res.json({ success: 0, error: error });

      if (results.length < 1) return res.json({ success: 0, error: "No such entry" });

      bcrypt.compare(req.body.password, results[0].password, function(err, result) {
        if (result) {
          let userToken = newToken();
          users[results[0].id] = { token: userToken, id: results[0].id, username: results[0].username };

          return res.json({ success: 1, token: userToken });
        }
        else return res.json({ success: 0, error: "Bad pass" });
      });
    });
  }
  else return res.json({ success: 0, error: "Blank data" });
});

app.post('/adduser', jsonParser, (req, res) => {
  if (req.body.username && req.body.password) {
    bcrypt.hash(req.body.password, saltRounds, function(err, result) {
      if (result) {
        pool.query(`INSERT INTO tbl_users (username, password) VALUES ('${req.body.username}', '${result}')`, function (error, results, fields) {
          if (error) return res.json({ success: 0, error: error });

          return res.json({ success: 1 });
        });
      }
      else return res.json({ success: 0, error: "Error hashing pass" });
    });
  }
  else return res.json({ success: 0, error: "Blank data" });
});

app.post('/addtest', jsonParser, (req, res) => {
  if (req.body.title && req.body.questions.length > 0) {
    let slug = req.body.title.toLowerCase().trim().replaceAll(" ", "_");

    pool.query(`INSERT INTO tbl_tests (test_name, test_slug) VALUES ('${req.body.title}', '${slug}')`, function (error, results, fields) {
      if (error) return res.json({ success: 0, error: error });

      let createdTestID = results.insertId;

      if (createdTestID) {
        let groupedOptions = [];

        let query = `INSERT INTO tbl_questions
            ( question_name, parent_test )
          VALUES`;

        let queryArr = [];

        for (var i = 0; i < req.body.questions.length; i++) {
          queryArr.push(`('${req.body.questions[i].title}', ${createdTestID})`);

          groupedOptions.push(req.body.questions[i].options);
        }

        query += queryArr.join(', ');

        pool.query(query, function (error, results, fields) {
          if (error) {
            console.log(error);
            return res.json({ success: 0, error: error });
          }

          pool.query(`SELECT question_id FROM tbl_questions WHERE parent_test = '${createdTestID}'`, function (error, results, fields) {
            if (error) {
              console.log(error);
            }

            query = `INSERT INTO tbl_options
                ( name, parent_question )
              VALUES`;

            queryArr = [];

            for (var i = 0; i < results.length; i++) {

              for (var j = 0; j < groupedOptions[i].length; j++) {

                queryArr.push(`('${groupedOptions[i][j].title}', ${results[i].question_id})`);

              }
            }

            query += queryArr.join(', ');

            pool.query(query, function (error, results, fields) {
              if (error) {
                console.log(error);
                return res.json({ success: 0, error: error });
              }

              return res.json({ success: 1 });
            });

          });

        });
      }
      else {
        //error
      }

      //return res.json({ success: 1 });
    });
  }
  else return res.json({ success: 0, error: "Blank data" });
});
 
app.post('/answer', jsonParser, (req, res) => {
  //console.log("submitted answers", req.body)

  let studID;

  Object.entries(users).forEach(([key, value]) => {
    if (value.token == req.body.student) studID = value.id;
  });

  let query = `INSERT INTO tbl_answers
      ( student_id, test_id, question_id, option_id )
    VALUES`;

    `
      ('John', 123, 'Lloyds Office'), 
      ('Jane', 124, 'Lloyds Office'), 
      ('Billy', 125, 'London Office'),
      ('Miranda', 126, 'Bristol Office');`;

  let queryItems = [];

  for (let answer in req.body.answers) {
    for (var i = 0; i < req.body.answers[answer].length; i++) 
      queryItems.push(`(${studID || 'NULL'}, ${req.body.test_id}, ${answer}, ${req.body.answers[answer][i]})`);
  }

  query += queryItems.join(", ");

  pool.query(query, function (error, results, fields) {
    if (error) return res.json({ success: 0, error: error });

    return res.json({ success: 1 });
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