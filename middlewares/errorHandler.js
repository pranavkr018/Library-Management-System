function errorHandler(err, req, res, next){
    console.log(err);

    res.status(500).json({
        error: err.message
    });
}


export default errorHandler;