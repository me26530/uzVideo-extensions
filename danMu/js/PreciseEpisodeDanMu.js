// ignore
//@name:danmu_api日志探针
//@version:99
//@remark:测试 uz 弹幕扩展是否能请求 danmu_api
//@codeID:
//@env:
// ignore

class DanmuApiProbe {
  getLines() {
    throw new Error('DEBUG getLines 已进入')
  }

  async searchDanMu(args) {
    throw new Error('DEBUG searchDanMu 已进入: ' + JSON.stringify(args))
  }
}

var danmuApiProbe = new DanmuApiProbe()
