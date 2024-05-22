const IS_DEV = process.env.APP_VARIANT === "development";

export default {
  expo: {
    name: IS_DEV ? "Art Museum Dev" : "Art Museum",
    slug: "appjs24-workflows-workshop-code",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_DEV ? "com.bCpm.appjs-dev" : "com.bCpm.appjs-prod",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.expo.appjs24workflowsworkshopcode" + (IS_DEV ? "dev" : ""),
    },
    web: {
      bundler: "metro",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [["expo-router"]],
    experiments: {
      typedRoutes: true,
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "4d9e34f2-cfad-4c14-b5e7-fc88d4813d87",
      },
    },
    owner: "b_cpm",
    updates: {
      url: "https://u.expo.dev/4d9e34f2-cfad-4c14-b5e7-fc88d4813d87",
    },
  },
};
