import "./App.css";
import LoadingScreen from "./components/LoadingScreen";
import { useCurrentUser } from "./hooks/useGetCurrentUser";

import Home from "./pages/Home";

function App() {
  const { loading: currentUserLoading } = useCurrentUser();

  if (currentUserLoading) {
    return <LoadingScreen />;
  }
  return <Home />;
}

export default App;
