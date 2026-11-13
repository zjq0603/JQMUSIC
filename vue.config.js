module.exports = {
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: ['a56fbfad.natappfree.cc'],
    proxy: { '/api': { target: 'http://127.0.0.1:3000' } }
  },
  productionSourceMap: false,
  configureWebpack: { resolve: { alias: { 'vue$': 'vue/dist/vue.esm.js' } } },
  chainWebpack(config) {
    config.plugin('html').tap(args => {
      args[0].title = 'JQ MUSIC'
      return args
    })
  }
}
