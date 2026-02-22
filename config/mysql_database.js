require("dotenv").config()
const { Sequelize} = require("sequelize")

const sequelize = new Sequelize(process.env.SQL_DATABASE,
    process.env.SQL_USERNAME,
    process.env.SQL_PASSWORD,
    {
    dialect:"mysql",
    host:process.env.SQL_HOST,
    port:process.env.SQL_PORT || 3306,  
    logging:false
});

module.exports=sequelize