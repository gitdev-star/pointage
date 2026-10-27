import { useEffect, useState } from "react";
import hrClient from "../../../api/hrClient";

export default function useBadgeMap() {
  const [badgeMap, setBadgeMap] = useState(null);
  useEffect(() => {
    hrClient.get("employees/badge-map/")
      .then((r) => setBadgeMap(r.data))
      .catch(() => setBadgeMap(null));
  }, []);
  return badgeMap;
}
