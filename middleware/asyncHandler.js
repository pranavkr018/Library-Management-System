function asyncHandler(controller){
    return function(req, res, next){
        controller(req, res)
            .catch(next);
    };
}

export default asyncHandler;