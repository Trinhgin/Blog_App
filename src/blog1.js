//Set dependencies
const express = require('express');
const Sequelize = require('sequelize');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const session = require('express-session')
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const app = express();

//set up the database with sequelize
const sequelize = new Sequelize(process.env.BLOGAPP, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, {
    host: process.env.POSTGRES_HOST,
    dialect: 'postgres',
    port: process.env.POSTGRES_PORT,
    default: {
        timestamp: false
    },
    storage: './session.postgres'
})

//connect with public folder (css, etc.)
app.use(express.static('public'))

//connect with template engine folder(ejs)
app.set('views', '../views')
app.set('view engine', 'ejs')

//set up bodyParser 
app.use(bodyParser.urlencoded({ extended: true }))

//set up session (expiration time)
app.use(session({
    store: new SequelizeStore({
        db: sequelize,//values are passed from const sequelize
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: 24 * 60 * 60 * 1000
    }),
    secret: "safe",
    saveUnitialized: true,
    resave: false
}))

//create variables matching with the tables in db
const User = sequelize.define('users', {
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    email: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, {
        timestamp: false
    })

const Post = sequelize.define('posts', {
    title: {
        type: Sequelize.STRING,
        allowNull: false
    },
    content: {
        type: Sequelize.STRING,
        allowNull: false
    }
})

const Comments = sequelize.define('comments', {
    content: {
        type: Sequelize.STRING,
        allowNull: false
    }
})

// Relationships - one to many 
User.hasMany(Post, { foreignKey: { allowNull: false } });
Post.belongsTo(User, { foreignKey: { allowNull: false } });
Comments.belongsTo(Post, { foreignKey: { allowNull: false } });
Comments.belongsTo(User, { foreignKey: { allowNull: false } });

//Route - Home
app.get('/', (req, res) => {
    var user = req.session.user
    res.render('home', { loginFailed: false })
})

//Route - check if user already exists in db
app.post('/', (req, res) => {
    console.log('Check name' + JSON.stringify(req.body))
    // var user = req.body.user
    var name = req.body.name
    var password = req.body.password
    if (name.length === 0) {
        res.render('home', { loginFailed: true})
        // res.render('oops');
        return;
    }
    if (password.length === 0) {
        res.render('home', { loginFailed: true})
        // res.render('oops');
        return;
    }
    User.findOne({
        where: {
            name: name 
        }
    }).then((user)=>{
        console.log('PASSWORD TEST' + JSON.stringify(user))
        if (name !== null && password === user.password) {
            req.session.user = user;
            res.redirect('welcome');
        } else {
            res.render('oops');
        }
    })
})

//Route - Log out
app.get('/logout', (req, res) => {
    req.session.destroy((error) =>{
        if (error) {
            throw error;
        }
        res.redirect('/');
    })

})

// Route - Sign up
app.get('/signup', (req, res) => {
    res.render('signup'); 
})

app.post('/signup', (req, res) => {
    console.log("TEST REQ BODY " + JSON.stringify(req.body))
    var inputname = req.body.name
    var inputemail = req.body.email
    var inputpassword = req.body.password
    console.log("User's credentials: " + inputname + " " + inputemail + " " + inputpassword);

    User.create({
        name: inputname,
        email: inputemail,
        password: inputpassword
    }).then((user) => {
        req.session.user = user;
        res.redirect('welcome')
    })
})

app.get('/welcome', (req,res)=>{
    console.log("CHECK USER SESSION " + JSON.stringify(req.session.user))
    var user = req.session.user;
    if(user != null){
        console.log("CHECK USER" + JSON.stringify(user))
        res.render('welcome')
    }else{
        res.redirect('/')
    }
})

//Route - Create post
app.get('/create_post', (req,res)=>{
    res.render('createpost')
})

app.post('/create_post', (req, res) => {
    console.log("CHECK Title & Content " + JSON.stringify(req.body))
    console.log("CHECK SESSION " + JSON.stringify(req.session))
    var title = req.body.post_title;
    var content = req.body.post_content;
    var user = req.session.user;

    Post.create({
        title: title,
        content: content,
        userId: user.id
    })
        .then(() => {
            res.redirect('your_posts')
        })
        .catch((err)=>{
            console.log("ERROR " + err);
        });
})

app.get('/delete/:id', (req, res) => {
    Post.destroy({
        where: {
            id: req.params.id
        }
    })
    .then(() => {
        res.redirect('/your_posts')
    })
})

//Route - display all of your posts

app.get('/your_posts', (req, res) => {
    let user = req.session.user;
    if (user == null) {
        res.redirect('/')

    } else {
        var userId = user.id
        Post.findAll({

            where: {
                userId: userId
            },
            include: [{
                model: User
            }]
        })
            .then((yourposts) => {
                res.render('yourposts', { posts: yourposts });
            })
    }
})

//Route - display one of your specific posts
app.get('/yourspecificpost/:postId', (req, res) => {
    var postId = req.params.postId
    Post.findOne({
        where: {
            id: postId
        },
        include: [{
            mmodel: User
        }]
    })
        .then((yourspecificpost) => {
            res.render('yourspecificpost', { yourspecificpost: yourspecificpost });
        })
})

//Route - display all posts
app.get('/all_posts', (req,res)=>{//  /allposts is the form action where the GET/POST goes to
    Post.findAll({
        include:[{
            model: User
        }] 
    })
    .then((allposts)=>{
        res.render('posts', {posts: allposts})
    })
})
//Route - display a specific post of other users
app.get('/post/:postId', (req, res) => {
    let postId = req.params.postId
    Post.findOne({
        where: {
            id: postId
        },
        include: [{
            model: User
        }]
    })
    .then((post)=>{
        Comments.findAll({
            where:{
                postId: postId
            }
        })
        .then((comments) => {
            res.render('specificpost',{post: post, comments: comments})
        })
    })
})

// Route - Leave comments

app.get('/comment/:postId', (req,res)=>{
    let postId = req.params.postId
    res.render('comments', {postId: postId})
})

app.post('/comment/:postId', (req,res)=>{
    let postId = req.params.postId
    let userId = req.session.user.id
    let inputComment = req.body.inputComment
    // console.log("INPUT COMMENT " + req.body.inputComment)

 Comments.create({
     postId: postId,
     content: inputComment,
     userId: userId
 })
 .then((comment)=>{
     let postId = comment.postId
     res.redirect('/post/' + postId)
 })
})

sequelize.sync({force: false})
.then(()=>{
    User.bulkCreate([
        {name: "persona", email:"a@test.com", password:123, userId: 1},
        {name: "personb", email:"b@test.com", password:123, userId: 2},
    ], { ignoreDuplicates: true })
})
.then(()=>{
    Post.bulkCreate([
        {id: 1, title: "persona post 1", content:"persona post 1 content", userId: 1},
        {id: 2, title: "persona post 2", content:"persona post 2 content", userId: 1},
        {id: 3, title: "personb post 1", content:"personb post 1 content", userId: 2},
        {id: 4, title: "personb post 2", content:"personb post 2 content", userId: 2},
    ], { ignoreDuplicates: true })
})

app.listen(3000, () => {
    console.log('App is running on port 3000');
})