create table task (
	id int auto_increment not null primary key,
	name varchar(40),
    type varchar(20),
    task_origin_arr mediumtext not null,
    task_current_arr mediumtext not null,
    custom_def text,
    create_time timestamp not null default current_timestamp,
    update_time timestamp null default null on update current_timestamp
)