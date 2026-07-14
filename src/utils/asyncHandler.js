const asyncHandler = (requestHandler) =>{
    retrun (req,res,next) =>{
        Promise.resolve(requestHandler(req,res,next)).catch((err) => next(err))
        
    }
}