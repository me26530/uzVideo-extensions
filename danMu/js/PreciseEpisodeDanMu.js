// ignore
//@name:danmu_api返回测试
//@version:1
//@remark:测试 getLines 和 searchDanMu 返回格式
//@codeID:
//@env:
// ignore

var uzDanmuReturnTest = {
  getLines: function () {
    return JSON.stringify({
      error: '',
      data: [
        {
          name: '测试线路',
          id: 'test'
        }
      ]
    })
  },

  searchDanMu: function (args) {
    return JSON.stringify({
      error: '',
      data: [
        {
          time: 1,
          text: '测试弹幕 1',
          color: '#ffffff',
          type: 1
        },
        {
          time: 3,
          text: '测试弹幕 2',
          color: '#ff0000',
          type: 1
        }
      ]
    })
  }
}
