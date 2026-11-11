module.exports = {
  devServer: { port: 8080, proxy: { '/api': { target: 'http://127.0.0.1:3000' } } },
  productionSourceMap: false,
  configureWebpack: { resolve: { alias: { 'vue$': 'vue/dist/vue.esm.js' } } }
}
