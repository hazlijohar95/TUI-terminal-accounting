class Openaccounting < Formula
  desc "Terminal-native accounting software with AI-powered features"
  homepage "https://openaccounting.dev"
  url "https://registry.npmjs.org/openaccounting/-/openaccounting-0.2.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node@18"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "oa 0.2.0", shell_output("#{bin}/oa --version")
  end
end
