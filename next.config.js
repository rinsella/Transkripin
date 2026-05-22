const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@xenova/transformers", "onnxruntime-node"],
  },
  webpack: (config, { webpack, isServer }) => {
    const stub = path.resolve(__dirname, "stubs/onnxruntime-node.js");

    // Ignore *.node native binaries — used only by onnxruntime-node which we
    // never invoke (Whisper runs in browser via onnxruntime-web in a Worker).
    config.module.rules.push({
      test: /\.node$/,
      loader: "ignore-loader",
    });

    // Replace `require('onnxruntime-node')` (the static import in
    // @xenova/transformers/src/backends/onnx.js) with our empty stub for ALL
    // compilation layers (client, server, worker). Using alias `false` would
    // emit `webpackMissingModule` runtime throws — a real stub avoids that.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^onnxruntime-node$/, stub)
    );

    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "onnxruntime-node": stub,
      "onnxruntime-node$": stub,
      sharp$: false,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        path: false,
        crypto: false,
        os: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        child_process: false,
        worker_threads: false,
        sharp: false,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
