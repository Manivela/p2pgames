import { useEffect } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError();
  console.error(error);
  // a crash caught here never reaches the page's error handler: tell Sentry
  // (main.jsx); a page that doesn't exist isn't a crash
  useEffect(() => {
    if (error && !isRouteErrorResponse(error)) {
      window.Sentry?.captureException(error);
    }
  }, [error]);

  // a route that doesn't exist reaches here as a 404 response, not as no error
  if (!error || error.status === 404) {
    return (
      <div id="error-page">
        <h1>404</h1>
        <p>Page not found!</p>
      </div>
    );
  }
  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  );
}
