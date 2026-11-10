import { data } from "react-router";
import { NotFoundView } from "../components/NotFoundView";

/** unknown URLs: real HTTP 404 with the branded page */
export function loader() {
  throw data(null, { status: 404 });
}

export const meta = () => [{ title: "Страница не найдена | ARMORIX" }, { name: "robots", content: "noindex" }];

export default function NotFound() {
  return <NotFoundView />;
}
