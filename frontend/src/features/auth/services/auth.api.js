import axios from "axios"


const api = axios.create({
    baseURL: "https://my-genai-backend.onrender.com",
    withCredentials: true 
});

export const register = async ({username, email, password})=> {
    console.log("REGISTER API CALLED", username, email, password);
    try {
        const response = await  api.post('/api/auth/register', {
            username, email, password
   
    });

    console.log("REGISTER RESPONSE FROM SERVER:", response.data);

    return response.data

    } catch (err) {
        console.log(err);
        throw err;

    }
};

export const login = async({email, password})=> {
    try{
        console.log("LOGIN API CALLED",email,password);
        const response = await api.post('/api/auth/login',{
            email,
            password
        });
        console.log("LOGIN RESPONSE FROM SERVER:",response.data);
        return response.data;
    } catch (err) {
        console.log("LOGIN API ERROR;",err);
        throw err;
    }
};
    

export async function logout(){
    try{
        const respone = await api.get('/api/auth/logout', {
            withCredentials: true
        })
        return response.data
        } catch(err) {

        }
    }

export async function getMe() {
    try {
        const response = await api.get('/api/auth/get-me', {
            withCredentials: true
        })

        console.log("LOGIN RESPONSE:",response.data);

        return response.data;
    } catch (err) {
        console.error("LOGIN ERROR:", err.response?.data || err);
        throw err;
    }
}


