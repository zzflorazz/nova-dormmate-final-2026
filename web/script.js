// 获取页面元素
const temperatureInput = document.getElementById('temperature'); // 温度输入框
const humidityInput = document.getElementById('humidity');       // 湿度输入框
const analyzeButton = document.getElementById('analyze-btn');     // "分析环境"按钮
const result = document.getElementById('result');                 // 结果显示区
const historyArea = document.getElementById('history');           // 历史记录区
const exportBtn = document.getElementById('exportBtn');           // 导出 CSV 按钮
const speakBtn = document.getElementById('speakBtn');             // "朗读状态"按钮
const voiceBtn = document.getElementById('voiceBtn');             // "语音指令"按钮
const cameraBtn = document.getElementById('cameraBtn');           // "开启摄像头"按钮
const video = document.getElementById('video');                   // 摄像头预览
const snapBtn = document.getElementById('snapBtn');               // "拍照"按钮
const stopBtn = document.getElementById('stopBtn');               // "停止摄像头"按钮
const canvas = document.getElementById('canvas');                 // 快照画布
const snapshot = document.getElementById('snapshot');             // 快照图片

// 历史记录数组（刷新页面后会清空，本模块不要求持久化）
const history = [];

// 当前分析结果，供 TTS 朗读使用（随每次分析更新）
let currentStatus = '';   // 当前状态
let currentAdvice = '';   // 当前建议

// 状态与 CSS 类名的映射（用于结果区着色）
const statusClassMap = {
    '偏冷': 'status-cold',
    '偏热': 'status-hot',
    '偏湿': 'status-humid',
    '正常': 'status-normal'
};

// 判断函数：根据温度和湿度返回状态与建议
// 规则按顺序判断，温度优先
function judge(temperature, humidity) {
    if (temperature <= 18) {
        return { status: '偏冷', advice: '注意保暖' };
    }
    if (temperature >= 30) {
        return { status: '偏热', advice: '注意通风' };
    }
    if (humidity >= 75) {
        return { status: '偏湿', advice: '建议除湿' };
    }
    return { status: '正常', advice: '环境舒适' };
}

// 渲染历史记录：先清空原有记录项，再重新渲染所有记录
function renderHistory() {
    // 清空原有记录项（保留"历史记录"标题）
    historyArea.querySelectorAll('.history-item').forEach(function (item) {
        item.remove();
    });

    // 遍历 history 数组，逐条渲染
    history.forEach(function (record) {
        const item = document.createElement('p');
        item.className = 'history-item';
        item.textContent = `${record.time} | ${record.temperature}℃ | ${record.humidity}% | ${record.status}`;
        historyArea.appendChild(item);
    });
}

// 导出 CSV 功能
exportBtn.addEventListener('click', function () {
    // 构建 CSV：表头前加 BOM，让 Excel 正确识别中文
    let csv = '﻿time,temperature,humidity,status\n';

    // 遍历 history 数组，逐条追加（time 字段可能含逗号，用双引号包裹）
    history.forEach(function (item) {
        csv += `"${item.time}",${item.temperature},${item.humidity},${item.status}\n`;
    });

    // 用 Blob 生成 CSV 文件并触发下载
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dormmate.csv';
    link.click();

    // 释放内存
    URL.revokeObjectURL(url);
});

// 给"分析环境"按钮绑定点击事件
analyzeButton.addEventListener('click', function () {
    // 每次点击先重置结果区的状态样式类
    result.className = '';

    // 读取输入框的原始值（去除首尾空格）
    const temperatureRaw = temperatureInput.value.trim();
    const humidityRaw = humidityInput.value.trim();

    // 校验：空值
    if (temperatureRaw === '' || humidityRaw === '') {
        result.textContent = '请输入温度和湿度';
        return;
    }

    // 转换成数字
    const temperature = Number(temperatureRaw);
    const humidity = Number(humidityRaw);

    // 校验：非数字
    if (isNaN(temperature) || isNaN(humidity)) {
        result.textContent = '请输入有效数字';
        return;
    }

    // 校验：温度合理范围（-50 ~ 100）
    if (temperature < -50 || temperature > 100) {
        result.textContent = '温度超出合理范围';
        return;
    }

    // 校验：湿度范围（0 ~ 100）
    if (humidity < 0 || humidity > 100) {
        result.textContent = '湿度应在 0-100 之间';
        return;
    }

    // 校验通过，调用判断函数得到状态与建议
    const { status, advice } = judge(temperature, humidity);

    // 保存到全局变量，供朗读功能读取
    currentStatus = status;
    currentAdvice = advice;

    // 将结果展示到结果区，并根据状态设置对应的颜色类
    result.textContent = `当前状态：${status}，建议：${advice}`;
    result.className = statusClassMap[status] || '';

    // 生成一条历史记录并追加到 history 数组
    history.push({
        time: new Date().toLocaleString(),
        temperature: temperature,
        humidity: humidity,
        status: status
    });

    // 重新渲染历史记录区
    renderHistory();
});

// 摄像头相关状态：保存媒体流，便于后续管理
let stream = null;

// 开启摄像头：请求权限并显示预览
function startCamera() {
    // 摄像头只在安全上下文（https 或 localhost）下可用
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('当前环境不支持摄像头，请通过 http://localhost:8000 访问');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (mediaStream) {
            stream = mediaStream;
            video.srcObject = mediaStream; // 把视频流赋给 video，显示预览
        })
        .catch(function (err) {
            console.error('开启摄像头失败：', err);
            alert('无法开启摄像头，请检查权限设置');
        });
}

// 拍照：把视频当前帧画到 canvas，再转成图片显示
function takeSnapshot() {
    if (!stream) {
        alert('请先开启摄像头');
        return;
    }

    // 设置画布尺寸为视频当前帧的尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    // 把视频当前帧绘制到画布上
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 从画布取出 PNG 数据，显示到 img 上
    snapshot.src = canvas.toDataURL('image/png');
}

// 停止摄像头：关闭视频流并清空预览
function stopCamera() {
    if (stream) {
        // 停止每一条媒体轨道（这里是视频轨道），释放摄像头
        stream.getTracks().forEach(function (track) {
            track.stop();
        });
        stream = null;
    }
    video.srcObject = null; // 清空预览画面
}

// 绑定摄像头按钮事件（用户主动点击才请求，不连续采集）
cameraBtn.addEventListener('click', startCamera);
snapBtn.addEventListener('click', takeSnapshot);
stopBtn.addEventListener('click', stopCamera);

// 朗读当前状态（文字转语音，使用浏览器自带 speechSynthesis）
function speakCurrentStatus() {
    // 尚未分析时没有可朗读的内容
    if (!currentStatus || !currentAdvice) {
        alert('请先分析环境');
        return;
    }

    // 朗读内容随当前分析结果变化，不写死
    const utterance = new SpeechSynthesisUtterance(`当前状态：${currentStatus}，建议：${currentAdvice}`);
    utterance.lang = 'zh-CN';
    speechSynthesis.speak(utterance);
}

speakBtn.addEventListener('click', speakCurrentStatus);

// 语音识别对象（Chrome/Edge 支持，需通过 localhost 访问）
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    // 识别到结果：把文字显示到结果区，并按指令触发已有功能
    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;

        // 显示识别到的文字
        result.className = '';
        result.textContent = `识别到：${transcript}`;

        handleVoiceCommand(transcript);
    };

    // 识别出错时打印错误信息
    recognition.onerror = function (event) {
        console.error('语音识别出错：', event.error);
    };
}

// 根据识别文字触发已有功能（固定指令）
function handleVoiceCommand(text) {
    if (text.includes('朗读') || text.includes('读状态')) {
        speakCurrentStatus();   // 触发 TTS 朗读当前状态
    } else if (text.includes('拍照')) {
        takeSnapshot();         // 触发拍照
    }
}

// "语音指令"按钮：启动识别
voiceBtn.addEventListener('click', function () {
    if (!SpeechRecognition) {
        alert('当前浏览器不支持语音识别');
        return;
    }
    recognition.start();
});
