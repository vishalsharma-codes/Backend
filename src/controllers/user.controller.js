import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"


const generateAccessAndRefreshTokens = async(userId)=> {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefeshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        
        return{accessToken , refreshToken}
    }
    catch(error){
        throw new ApiError(500, "Something went wrong while generating access and refresh tokens")
    }
}

const registerUser = asyncHandler(async (req,res) =>{
    
    const{fullName, email , username , password }= req.body
    // console.log("email: ", email);

    if(
        [fullName, email , username , password].some((field) =>field?.trim() === "")
    ){
        throw new ApiError(400 , "All feilds are required")
    }

    const existedUser = await User.findOne({
        $or:[{ username },{ email }]
       
    });
     

    if(existedUser){
        throw new ApiError(409, "User with this email or username already exists")
    }
    // console.log(req.body);

    const avatarLocalPath= req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // console.log("Path: ", {avatarLocalPath , coverImageLocalPath})

    if(!avatarLocalPath){
        throw new ApiError(400 , "Avatar file is still required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // console.log("Cloudinary results:", { avatar, coverImage });

    if(!avatar){
        throw new ApiError(400 , "Avatar file is also required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500 , "Something went wrong while registering")
    }
     
    return res.status(201).json(
        new ApiResponse(200 , createdUser,"User registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res) =>{
// req body -> data,
// username or email,
// find user
// check password
// access and refresh token
// send cokie

    const {email, username, password} = req.body

    if(!username || !email){
        throw new ApiError(400, "Username or email is required")
    }

    const user = User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not Exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(404, "Invalid user credentials")
    }

    const{refreshToken , accessToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cokiee("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,{
                user: loggedInUser, refreshToken, accessToken
            },
            "User logged in Successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) =>{
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken : undefined
            }
        },{
            new:true
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

export{ 
    registerUser,
    loginUser,
    logoutUser
}