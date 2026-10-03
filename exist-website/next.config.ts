import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    Hide the floating "N" dev badge — it ended up baked into the
    screen-recorded intro frames once already.
  */
  devIndicators: false,
};

export default nextConfig;
