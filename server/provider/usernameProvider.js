const http = require("http");

module.exports.getRandomUsername = async (numberOfWords = 2) => {
    return new Promise((resolve, reject) => {
        http.get(
            "http://names.drycodes.com/1?nameOptions=objects&combine=" +
                numberOfWords,
            resp => {
                let data = "";
                resp.on("data", chunk => {
                    data += chunk;
                });

                resp.on("end", () => {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData[0]);
                });
            }
        ).on("error", err => {
            reject(err);
        });
    });
};
