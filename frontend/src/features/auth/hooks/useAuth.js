import { useContext, useEffect } from "react";
import { AuthContext } from "../auth.context";
import { login, register, logout, getMe} from "../services/auth.api";

export const useAuth = () => {

    const context = useContext(AuthContext)
    const { user, setUser, loading, setLoading} = context

    const handleLogin = async ({ email, password }) => {
        setLoading(true)
        try {
             const data = await login({ email , password })

            console.log("LOGIN API CALLED", email,password);
             setUser(data.user)

             return true;
        } catch (err) {
            console.error("HANDLE LOGIN ERROR:",err);
                return false;

        } finally {
            setLoading(false)
        }
       
    }

    const handleRegister = async ({ username, email, password }) => {
        console.log("HANDLE REGISTER CALLED");
        console.log({username, email, password});
        setLoading(true)
        try {
            const data = await register({ username, email, password});
            console.log("REGISTER RESPONSE:",data);
            setUser(data.user)
        } catch (err) {
            console.error("REGISTER ERROR:",err);

        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
             const data = await logout()
             setUser(null)

        } catch (err) {

        } finally {
            setLoading(false)

        }
        
    }

    return { user, loading, handleRegister, handleLogin, handleLogout}


}