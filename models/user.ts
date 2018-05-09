export default class User{
	id:number;
	username:string;
	account:string;
	phone:string;
	sex:number;
	email:string;
	password:string;
	avatar:string;
	constructor(id:number, username:string, account:string, password:string, phone:string, sex:number, email:string,avatar:string){
		this.id=id;
		this.username=username;
		this.account=account;
		this.phone=phone;
		this.sex=sex;
		this.email=email;
		this.password=password;
		this.avatar=avatar;
	}
}