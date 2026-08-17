import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import NotFoundImg from "@/assets/Images/404.png";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
     <div className="flex flex-col items-center justify-center min-h-screen bg-white text-center">
      {/* Illustration */}
      <img
        src={NotFoundImg}
        alt="404 Illustration"
        className="w-[55%] mb-1"
      />
      <p className="text-lg text-gray-600">
        Oops! The page you’re looking for is missing from inventory.
      </p>

      {/* Action */}
      <Button
        onClick={() => navigate(-1)}
        className="mt-6 px-6 py-2 text-base rounded-xl"
      >
        Go Back Home
      </Button>
    </div>
  );
}

export default NotFoundPage;