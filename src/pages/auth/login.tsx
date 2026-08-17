import { LoginForm } from "@/components/login-form"

export const Login = () => {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-indigo-50 to-blue-50 px-6 md:px-10">
        <div className="w-full transform transition-all duration-300">
          <LoginForm />
        </div>
      </div>
    );
  };
