export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">404 - Not Found</h2>
        <p className="text-gray-500 mb-8">Could not find requested resource</p>
        <a href="/" className="text-blue-500 hover:underline">
          Return Home
        </a>
      </div>
    </div>
  );
}
