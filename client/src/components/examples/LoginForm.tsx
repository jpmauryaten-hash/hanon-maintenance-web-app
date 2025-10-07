import LoginForm from '../LoginForm';

export default function LoginFormExample() {
  return (
    <LoginForm onLogin={(username, password) => console.log('Login:', username, password)} />
  );
}
