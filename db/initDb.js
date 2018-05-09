function init(connection){

	var user=`CREATE TABLE user (
		id int auto_increment primary key,
		username varchar(10) not null,
		account varchar(20) not null unique,
		phone char(11) not null unique,
		sex tinyint(2), //1 male; 2 female
		email varchar(30),
		avatar varchar(200)
	)`;


	connection.query(user);

}

module.exports=init;