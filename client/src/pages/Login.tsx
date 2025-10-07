import LoginForm from "@/components/LoginForm";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();

  const handleLogin = (username: string, password: string) => {
    console.log('Login successful');
    setLocation('/');
  };

  return <LoginForm onLogin={handleLogin} />;
}
